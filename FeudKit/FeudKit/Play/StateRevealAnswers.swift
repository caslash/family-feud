//
//  StateRevelAnswers.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/26/23.
//

import Foundation

public class StateRevealAnswers: FFPlayState {
    public static var ACTION_OPENANSWER: Int = 2
    
    private var question: Question?
    
    internal init() {
        super.init(type: FFPlayStateType.REVEAL_ANSWERS)
    }
    
    public override func initState(data: Any) {
        if (data is Question) {
            self.question = data as? Question
        } else {
            //TODO: InvalidDataException
            fatalError("InvalidDataException not implemented")
        }
    }
    
    public override func cleanupState() { }
    
    public override func executeAction(action: Int, data: [Any]) -> Bool {
        switch action {
        case 2:
            if (data[1] is Int) {
                self.openAnswer(index: data[1] as! Int)
                return true
            }
        default:
            //TODO: RuntimeException
            fatalError("RuntimeException not implemented")
        }
        
        return false
    }
    
    public func openAnswer(index: Int) {
        if (!(self.question!.getAnswers()[index]).isRevealed()) {
            (self.question!.getAnswers()[index]).setRevealed(revealed: true)
            //TODO: Logger
        } else {
            //TODO: Logger
        }
    }
}
