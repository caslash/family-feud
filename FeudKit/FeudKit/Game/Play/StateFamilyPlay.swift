//
//  StateFamilyPlay.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/26/23.
//

import Foundation

public class StateFamilyPlay: FFPlayState, StrikeInterface {
    public static var ACTION_OPENANSWER: Int = 2
    
    public static var ACTION_STRIKE: Int = 3
    
    public static var ACTION_SELECTSTEALFAMILY = 4
    
    private var question: Question?
    
    private var selectedFamilyIndex: Int?
    
    private var strikes: Int?
    
    internal init() {
        super.init(type: FFPlayStateType.FAMILY_PLAY)
    }
    
    public override func initState(data: Any?) {
        self.strikes = 0
        
        let d: [Any] = data as! [Any]
        self.question = d[0] as? Question
        self.selectedFamilyIndex = d[1] as? Int
    }
    
    public override func cleanupState() {
        self.data = [self.question as Any, self.selectedFamilyIndex as Any]
        self.strikes = 0
    }
    
    public override func canAdvance(nextState: String) -> Bool {
        if (nextState.caseInsensitiveCompare(FFPlayStateType.ALLOCATE_POINTS.description) != .orderedSame) {
            if (nextState.caseInsensitiveCompare(FFPlayStateType.FAMILY_STEAL.description) == .orderedSame) {
                return self.strikes ?? 0 == 3
            } else {
                return false
            }
        } else {
            var clearedBoard: Bool = true
            
            for answer in self.question!.getAnswers() {
                clearedBoard = clearedBoard && answer.isRevealed()
            }
            
            return clearedBoard
        }
    }
    
    public override func executeAction(action: Int, data: [Any]) -> Bool {
        switch action {
        case 2:
            if (data[1] is Int) {
                return self.openAnswer(index: data[1] as! Int)
            }
            
            //TODO: InvalidDataException
            fatalError("InvalidDataException not implemented")
        case 3:
            return self.strike()
        case 4:
            if(data[1] is Int) {
                self.selectStealFamily(index: data[1] as! Int)
                return true
            }
            
            //TODO: InvalidDataException
            fatalError("InvalidDataException not implemented")
        default:
            //TODO: RuntimeException
            fatalError("RuntimeException not implemented")
        }
    }
    
    private func strike() -> Bool {
        if (self.strikes ?? 0 >= 3) {
            //TODO: Logger
            print("Strike limit reached: Other family should be given the chance to steal.")
            return false
        } else {
            self.strikes! += 1
            //TODO: Logger
            print("Family [\(self.selectedFamilyIndex!)] now has \(self.strikes!) strike(s).")
            return true
        }
    }
    
    public func getStrikes() -> Int? { return self.strikes }
    
    private func openAnswer(index: Int) -> Bool {
        if (self.strikes ?? 0 < 3) {
            if (!self.question!.getAnswers()[index].isRevealed()) {
                self.question!.getAnswers()[index].setRevealed(revealed: true)
                //TODO: Logger
                print("Revealed answer: \(self.question!.getAnswers())")
                return true
            } else {
                //TODO: Logger
                print("Answer already revealed!")
            }
        } else {
            //TODO: Logger
            print("Strike limit reached: Cannot reveal more answers for family [\(self.selectedFamilyIndex!)]")
        }
        
        return false
    }
    
    private func selectStealFamily(index: Int) {
        if (self.strikes == 3) {
            self.selectedFamilyIndex = index
            //TODO: Logger
            print("Family [\(self.selectedFamilyIndex!)] selected as potential stealers.")
        } else {
            //TODO: Logger
            print("Cannot assign family [\(index)] as stealers: \(3 - (self.strikes ?? 0)) strike(s) remaining")
        }
    }
}
