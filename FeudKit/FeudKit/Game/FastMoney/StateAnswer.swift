//
//  StateAnswer.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/29/23.
//

import Foundation

public class StateAnswer: FFFastMoneyState {
    public static var ACTION_UPDATEANSWER = 0x10
    
    public static var ACTION_UPDATESCORE = 0x11
    
    private final var PLAYER: Int
    
    public override init(fastmoney: FastMoney, player: Int) {
        self.PLAYER = player
        super.init(fastmoney: fastmoney, player: player)
    }
    
    public override func initState(data: Any?) { }
    
    public override func cleanupState() { }
    
    public override func canAdvance(nextState: String) -> Bool {
        if (self.PLAYER == 0) {
            return nextState == FFFastMoneyStateType.P1_REVEAL.description
        } else if (self.PLAYER == 1) {
            return nextState == FFFastMoneyStateType.P2_REVEAL.description
        }
        return false
    }
    
    public override func executeAction(action: Int, data: [Any]) -> Bool {
        switch action {
        case StateAnswer.ACTION_UPDATEANSWER:
            if (data.count == 3 && data[1] is Int && data[2] is String) {
                self.updateAnswer(question: data[1] as! Int, answer: data[2] as! String)
                return true
            } else {
                //TODO: InvalidDataException
                fatalError("InvalidDataException not implemented")
            }
        case StateAnswer.ACTION_UPDATESCORE:
            if(data.count == 3 && data[1] is Int && data[2] is Int) {
                self.updateScore(question: data[1] as! Int, score: data[2] as! Int)
                return true
            } else {
                //TODO: InvalidDataException
                fatalError("InvalidDataException not implemented")
            }
        default:
            //TODO: RuntimeException
            fatalError("RuntimeException not implemented")
        }
    }
    
    private func updateAnswer(question: Int, answer: String) { self.fastmoney.getAnswer(player: self.PLAYER, question: question).setAnswer(answer: answer) }
    
    private func updateScore(question: Int, score: Int) { self.fastmoney.getAnswer(player: self.PLAYER, question: question).setScore(score: score) }
}
