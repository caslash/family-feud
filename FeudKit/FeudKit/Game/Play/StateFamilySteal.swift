//
//  StateFamilySteal.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/26/23.
//

import Foundation

public class StateFamilySteal: FFPlayState, StrikeInterface {
    public static var ACTION_OPENANSWER: Int = 2
    
    public static var ACTION_STRIKE: Int = 3
    
    public static var ACTION_SELECTWINFAMILY: Int = 5
    
    private var question: Question?
    
    private var selectedWinFamilyIndex: Int?
    
    private var selectedStealFamilyIndex: Int?
    
    private var strikes: Int?
    
    internal init() {
        super.init(type: FFPlayStateType.FAMILY_STEAL)
    }
    
    public override func initState(data: Any?) {
        let d: [Any] = data as! [Any]
        self.question = d[0] as? Question
        self.selectedStealFamilyIndex = d[1] as? Int
        
        self.selectedWinFamilyIndex = -1
        self.strikes = 0
    }
    
    public override func cleanupState() {
        self.data = [self.question as Any, self.selectedWinFamilyIndex as Any]
    }
    
    public override func executeAction(action: Int, data: [Any]) -> Bool {
        switch action {
        case 2:
            if (data[1] is Int) {
                self.openAnswer(index: data[1] as! Int)
                return true
            }
        case 3:
            self.strike()
            return true
        case 5:
            if (data[1] is Int) {
                self.selectWinFamily(index: data[1] as! Int)
                return true
            }
        default:
            //TODO: RuntimeException
            fatalError("RuntimeException not implemented")
        }
        
        return false
    }
    
    public override func canAdvance(nextState: String) -> Bool { return self.selectedWinFamilyIndex ?? -1 > -1 }
    
    private func strike() {
        if (self.selectedStealFamilyIndex ?? 0 < 0) {
            //TODO: Logger
            print("No family selected as potential stealers")
        } else if (self.strikes ?? 0 > 0) {
            //TODO: Logger
            print("Only one strike permitted in a steal phase. Please select a winning team.")
        } else {
            self.strikes = self.strikes ?? 0 + 1
            //TODO: Logger
            print("Family [\(self.selectedStealFamilyIndex!)] now has \(self.strikes!) strike(s).")
        }
    }
    
    public func getStrikes() -> Int? { return self.strikes }
    
    public func openAnswer(index: Int) {
        if (self.selectedStealFamilyIndex ?? -1 > -1) {
            if(!self.question!.getAnswers()[index].isRevealed()) {
                self.question!.getAnswers()[index].setRevealed(revealed: true)
                //TODO: Logger
                print("Revealed answer: \(self.question!.getAnswers()[index])")
            } else {
                //TODO: Logger
                print("Answer already revealed!")
            }
        } else {
            //TODO: Logger
            print("No family selected as potential stealers")
        }
    }
    
    private func selectWinFamily(index: Int) {
        self.selectedWinFamilyIndex = index
        //TODO: Logger
        print("Family [\(self.selectedWinFamilyIndex!)] selected to receive points.")
    }
}
